import { loadConfig } from './config.mjs';
import { createStore } from './store.mjs';
import { createApp } from './app.mjs';
const config=loadConfig();
const store=createStore(config.databasePath);
const server=createApp(config,store).listen(config.port,config.host,()=>{
  console.log('CoBid API: http://'+config.host+':'+config.port);
  console.log(config.adapter?'Tide adapter loaded. Live cryptography still requires realm enrolment and verification.':'Setup required: '+config.issue);
});
function shutdown(){server.close(()=>{store.close();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
