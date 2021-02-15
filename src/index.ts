import joplin from 'api';
import { ContentScriptType, SettingItem, SettingItemType, ToolbarButtonLocation } from 'api/types';
const path = require('path');
const mimeType = require('mime-types');
const fs = joplin.plugins.require('fs-extra');
const sqlite3 = joplin.plugins.require('sqlite3');

const http = require('http');
const url = require('url');

joplin.plugins.register({
	onStart: async function () {
		const pluginDir = await joplin.plugins.dataDir();
		let rootDir = pluginDir.split("/")
		// console.info('Checking if "' + pluginDir + '" exists:', await fs.pathExists(pluginDir));
		rootDir.pop();
		rootDir.pop();
		console.log("rootDir->", rootDir);
		let rootDirStr = rootDir.join("/")
		console.log("rootDirStr->", rootDirStr);
		console.info('changeImgToBase64 plugin started!');
		function parse(file) {
			let filePath = path.resolve(file); // 原始文件地址
			let fileName = filePath.split('\\').slice(-1)[0].split('.'); // 提取文件名
			let fileMimeType = mimeType.lookup(filePath); // 获取文件的 memeType

			// 如果不是图片文件，则退出
			if (!fileMimeType.toString().includes('image')) {
				console.log(`Failed! ${filePath}:\tNot image file!`);
				return;
			}
			// 读取文件数据
			let data = fs.readFileSync(filePath);
			data = Buffer.from(data).toString('base64');
			// 转换为 data:image/jpeg;base64,***** 格式的字符串
			let base64 = 'data:' + fileMimeType + ';base64,' + data;
			console.log("toBase64->", typeof (base64));
			return data
		}

		//req 请求信息   res返回信息
		http.createServer(function (req, res) {
			res.writeHeader(200, { 'Content-Type': 'text/javascript;charset=UTF-8' });  //状态码+响应头属性
			console.log("req->", req);

			if (req.method === "GET") {
				// 查看图片
				// 解析 url 参数
				var params = url.parse(req.url, true).query;  //parse将字符串转成对象,req.url="/?url=123&name=321"，true表示params是{url:"123",name:"321"}，false表示params是url=123&name=321
				//这里应该返回处理后的base64字符串用以渲染图片
				const db = new sqlite3.Database(`${rootDirStr + "/resources/" + "imgae.sqlite"}`);
				db.each(`select * from imgfornote where address = '${params.address}'`, function (err, row) {
					res.statusCode = 200;
					// res.setHeader('Accept-Ranges', 'bytes');
					// res.setHeader('Content-Type', 'image/png');
					console.log("row", row);
					let decodeImg = Buffer.from(row.body, 'base64')
					res.write(decodeImg);
					res.end();
				});
			} else if (req.url = "" || req.method === "POST") {
				//储存图片
				console.log("post start");
				alert("img post error!!!")

			}

		}).listen(3000);


		//创建图片数据库
		const db = new sqlite3.Database(`${rootDirStr + "/resources/" + "imgae.sqlite"}`);
		db.serialize(function () {
			db.run("CREATE TABLE IF NOT EXISTS imgfornote (ID INTEGER PRIMARY KEY autoincrement, address TEXT UNIQUE,body TEXT)")
			console.log("create imgfornote");

		});
		db.close();

		async function deleteImgInDB() {
			const deletedb = new sqlite3.Database(`${rootDirStr + "/resources/" + "imgae.sqlite"}`);
			let deleteItems = [];

			deletedb.serialize(function () {
				deletedb.each("SELECT address FROM imgfornote", async function (_err, row) {
					console.log("deleterow", row);
					console.log("deletedbdb", db);

					let resourcess = await joplin.data.get(["search"], { query: row.address })
					if (resourcess.items.length == 0) {
						deleteItems.push(row.address)
						// deletedb.run(`delete from imgfornote where address='${row.address}'`)
					}
				});
			})
			// deletedb.close();
			if (deleteItems.length == 0) {
				alert("No image to delete!");
			} else {
				for (let i = 0; i < deleteItems.length; i++) {
					console.log("delete item->", deleteItems[i]);
					deletedb.run(`delete from imgfornote where address='${deleteItems[i]}'`)
					if (i == deleteItems.length - 1) {
						deletedb.close();
						alert("All done!");
					}
				}
			}
		}

		async function changeImgToBase64() {
			// let imgInResourceDir = getFiles.getImageFiles(rootDirStr + "/resources/")
			// console.log("imgInResourceDir", imgInResourceDir);
			//转化当前note中的图片为
			const note = await joplin.workspace.selectedNote();
			let IMAGE_PATTERN = /!\[(.*?)\]\((.*?)\)/mg;
			let imgList = []
			if (note.body) {
				// let result = IMAGE_PATTERN.exec(note.body)
				let matcher
				while ((matcher = IMAGE_PATTERN.exec(note.body)) !== null) {
					imgList.push({
						markdownStr: matcher[0],
						alt: matcher[1],
						url: matcher[2].split(":")[1]
					})
				}
				console.log("imgList->", imgList);
			} else {
				alert("No Img !!")
			}
			if (imgList.length > 0) {
				//图片入库
				const db = new sqlite3.Database(`${rootDirStr + "/resources/" + "imgae.sqlite"}`);
				db.serialize(function () {
					for (let i = 0; i < imgList.length; i++) {

						let imgDirPath = rootDirStr + "/resources" + imgList[i].url + "." + imgList[i].alt.split(".")[1]
						console.log("imgDirPath->", imgDirPath);
						let dataUrl = parse(imgDirPath);
						console.log("exec", `INSERT INTO imgfornote (address,body) VALUES ("${imgList[i].url.split("/")[1]}","${dataUrl}")`);

						db.run(`INSERT INTO imgfornote (address,body) VALUES ("${imgList[i].url.split("/")[1]}","${dataUrl}")`)

						console.log("dataUrl->", dataUrl);
						note.body = note.body.replace(imgList[i].markdownStr, `<div  align="center">
<img src="http://localhost:3000/?address=${imgList[i].url.split("/")[1]}" alt="${imgList[i].alt}" style="zoom:50%"/>
</div>`)
						if (imgDirPath) {
							fs.unlinkSync(imgDirPath, function (err) {
								if (err) throw err;
							});
						}
					}
					console.log("note.body->", note.body);
					console.log("imsert img");
				});
				db.close();
				await joplin.commands.execute("textSelectAll");
				await joplin.commands.execute("textCut");
				await joplin.commands.execute("insertText", note.body);
			}


		}

		await joplin.commands.register({
			name: 'imgToBase64',
			label: 'imgToBase64',
			iconName: 'fas fa-bug',
			execute: async () => {
				const note = await joplin.workspace.selectedNote();
				changeImgToBase64();
			},

		});
		await joplin.views.toolbarButtons.create('imgToBase64', 'imgToBase64', ToolbarButtonLocation.EditorToolbar);

		await joplin.commands.register({
			name: 'deleteImgInDB',
			label: 'deleteImgInDB',
			iconName: 'fas fa-trash',
			execute: async () => {
				const note = await joplin.workspace.selectedNote();

				deleteImgInDB();

			},

		});
		await joplin.views.toolbarButtons.create('deleteImgInDB', 'deleteImgInDB', ToolbarButtonLocation.NoteToolbar);
	},
});
