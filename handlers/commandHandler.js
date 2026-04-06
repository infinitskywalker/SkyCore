const fs = require('fs');
const path = require('path');

module.exports = (client) => {

  function readCommands(dir){
    const files = fs.readdirSync(dir);

    for(const file of files){
      const fullPath = path.join(dir, file);

      if(fs.lstatSync(fullPath).isDirectory()){
        readCommands(fullPath); // 🔁 recursive
      } else if(file.endsWith('.js')){
        const command = require(fullPath);
        client.commands.set(command.name, command);
      }
    }
  }

  readCommands(path.join(__dirname, '../commands'));
};