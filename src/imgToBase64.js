import joplin from "api";
async function changeImgToBase64() {
  const fs = joplin.plugins.require("fs-extra");
  const pluginDir = await joplin.plugins.dataDir();
  let rootDir = pluginDir.split("/");
  // console.info('Checking if "' + pluginDir + '" exists:', await fs.pathExists(pluginDir));
  console.log("rootDir->", rootDir);
}
setTimeout(() => {
  changeImgToBase64();
}, 3000);
