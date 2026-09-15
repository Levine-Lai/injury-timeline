const API_ORIGIN='https://v3.football.api-sports.io';

function json(value,status=200,origin='*'){
  return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'public, max-age=900','access-control-allow-origin':origin,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'content-type'}});
}

async function apiFootball(path,env,origin){
  if(!env.API_FOOTBALL_KEY)return json({error:'API_FOOTBALL_KEY is not configured'},503,origin);
  const response=await fetch(`${API_ORIGIN}${path}`,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY,Accept:'application/json'}});
  const body=await response.json();
  return json(body,response.status,origin);
}

export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=env.ALLOWED_ORIGIN||'*';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-methods':'GET, OPTIONS','access-control-allow-headers':'content-type'}});
    if(url.pathname==='/api/injuries'){
      const league=url.searchParams.get('league')||'39',season=url.searchParams.get('season')||String(new Date().getUTCFullYear());
      return apiFootball(`/injuries?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,env,origin);
    }
    if(url.pathname==='/api/player'){
      const player=url.searchParams.get('id');
      if(!player)return json({error:'player id required'},400,origin);
      const [current,history]=await Promise.all([apiFootball(`/injuries?player=${encodeURIComponent(player)}`,env,origin),apiFootball(`/sidelined?player=${encodeURIComponent(player)}`,env,origin)]);
      return json({current:await current.json(),history:await history.json()},200,origin);
    }
    return json({service:'injury-api-proxy',status:'ok'},200,origin);
  }
};

