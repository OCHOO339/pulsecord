const ttl=30*86400000;
const allowed=new Set(['https://discord.com','https://canary.discord.com','https://ptb.discord.com']);
const validId=id=>typeof id==='string'&&/^[1-9]\d{16,19}$/.test(id)&&BigInt(id)<=18446744073709551615n;
const decode=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
function json(value,status=200,extra={}){return Response.json(value,{status,headers:{'Cache-Control':'no-store',...extra}});}
export async function handle(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    if(origin&&!allowed.has(origin))return json({error:'Origin not allowed'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204});
    if(url.pathname==='/health')return json({service:'PulseCord badges',format:1});
    if(url.pathname==='/v1/users'&&request.method==='GET'){
        const {results}=await env.DB.prepare('SELECT DISTINCT user_id FROM installations WHERE seen_at > ? ORDER BY user_id LIMIT 10000').bind(Date.now()-ttl).all();
        return json({format:1,users:results.map(row=>row.user_id)});
    }
    if(url.pathname!=='/v1/installations'||!['POST','DELETE'].includes(request.method))return json({error:'Not found'},404);
    const reader=request.body?.getReader();if(!reader)return json({error:'Body required'},400);
    const chunks=[];let size=0;
    try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2048)return json({error:'Body too large'},413);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{return json({error:'Invalid JSON'},400);}
    const {userId,publicKey,timestamp,signature}=data;
    if(!validId(userId)||!Number.isSafeInteger(timestamp)||Math.abs(Date.now()-timestamp)>120000||typeof publicKey!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(publicKey)||typeof signature!=='string'||!/^[A-Za-z0-9_-]{86}$/.test(signature))return json({error:'Invalid registration'},400);
    const message=`pulsecord-badge-v1\n${request.method}\n${publicKey}\n${userId}\n${timestamp}`;
    let verified=false;try{const key=await crypto.subtle.importKey('raw',decode(publicKey),{name:'Ed25519'},false,['verify']);verified=await crypto.subtle.verify('Ed25519',key,decode(signature),new TextEncoder().encode(message));}catch{}
    if(!verified)return json({error:'Invalid installation signature'},401);
    if(request.method==='DELETE'){
        await env.DB.prepare('DELETE FROM installations WHERE public_key = ?').bind(publicKey).run();return json({ok:true});
    }
    await env.DB.prepare('DELETE FROM installations WHERE seen_at <= ?').bind(Date.now()-ttl).run();
    const result=await env.DB.prepare('INSERT INTO installations(public_key,user_id,seen_at) SELECT ?,?,? WHERE (SELECT count(*) FROM installations)<10000 OR EXISTS(SELECT 1 FROM installations WHERE public_key=?) ON CONFLICT(public_key) DO UPDATE SET user_id=excluded.user_id,seen_at=excluded.seen_at WHERE installations.seen_at < ? OR installations.user_id != excluded.user_id').bind(publicKey,userId,Date.now(),publicKey,Date.now()-12*3600000).run();
    const stored=await env.DB.prepare('SELECT user_id FROM installations WHERE public_key = ?').bind(publicKey).first();
    if(stored?.user_id!==userId)return json({error:'Registry capacity reached'},503);
    return json({ok:true});
}
export default {async fetch(request,env){let response;try{response=await handle(request,env);}catch{response=json({error:'Registry temporarily unavailable'},503);}
    const headers=new Headers(response.headers);const origin=request.headers.get('Origin');if(allowed.has(origin)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type');}
    headers.set('X-Content-Type-Options','nosniff');return new Response(response.body,{status:response.status,headers});
}};
