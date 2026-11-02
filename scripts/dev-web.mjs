import {spawn} from 'node:child_process'

// Vercel assigns each service a PORT; ordinary local development remains on 5173.
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',process.env.PORT??'5173','--strictPort'],{stdio:'inherit'})
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal))
child.on('error',error=>{console.error(error.message);process.exitCode=1})
child.on('exit',code=>{process.exitCode=code??1})
