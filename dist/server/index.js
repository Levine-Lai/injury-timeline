const API_ORIGIN='https://v3.football.api-sports.io';

async function apiFootball(path,env){
  if(!env.API_FOOTBALL_KEY)return new Response(JSON.stringify({error:'API_FOOTBALL_KEY is not configured'}),{status:503,headers:{'content-type':'application/json'}});
  const response=await fetch(`${API_ORIGIN}${path}`,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY,Accept:'application/json'}});
  const body=await response.text();
  return new Response(body,{status:response.status,headers:{'content-type':'application/json','cache-control':'public, max-age=900'}});
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/api/injuries'){
      const league=url.searchParams.get('league')||'39';
      const season=url.searchParams.get('season')||String(new Date().getUTCFullYear());
      return apiFootball(`/injuries?league=${encodeURIComponent(league)}&season=${encodeURIComponent(season)}`,env);
    }
    if(url.pathname==='/api/player'){
      const player=url.searchParams.get('id');
      if(!player)return new Response(JSON.stringify({error:'player id required'}),{status:400,headers:{'content-type':'application/json'}});
      const [current,history]=await Promise.all([apiFootball(`/injuries?player=${encodeURIComponent(player)}`,env),apiFootball(`/sidelined?player=${encodeURIComponent(player)}`,env)]);
      return new Response(JSON.stringify({current:await current.json(),history:await history.json()}),{headers:{'content-type':'application/json','cache-control':'public, max-age=900'}});
    }
    return env.ASSETS.fetch(request);
  }
};

