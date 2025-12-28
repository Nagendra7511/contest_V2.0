import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  // Exclude dynamic routes from prerendering
  {
    path: 'treasure-hunt',
    renderMode: RenderMode.Server
  },
  {
    path: 'match-it-right-words',
    renderMode: RenderMode.Server
  },
  {
    path: 'scratch-card',
    renderMode: RenderMode.Server
  },
  {
    path: 'spin-wheel',
    renderMode: RenderMode.Server
  },
  {
    path: 'word-game',
    renderMode: RenderMode.Server
  },
  {
    path:'memory-image',
    renderMode: RenderMode.Server
  },
  {
    path:'memory-word',
    renderMode: RenderMode.Server
  },
  {
    path:'price-it-right',
    renderMode: RenderMode.Server
  },
   {
    path:'puzzle',
    renderMode: RenderMode.Server
  },
  {
    path:'flappy-bird',
    renderMode: RenderMode.Server
  },
  {
      path: 'brand-info/:storeId',
      renderMode: RenderMode.Server
    },
    {
      path:'insta-comments',
      renderMode: RenderMode.Server
    },
    {
      path:'dino',
      renderMode: RenderMode.Server
    },
    {
      path:'quiz',
      renderMode: RenderMode.Server
    },
    {
      path:'click-game',
      renderMode: RenderMode.Server
    },
    {
      path:'word-search',
      renderMode: RenderMode.Server
    },
     {
      path:'car-race',
      renderMode: RenderMode.Server
    },
     {
      path:'boat-game',
      renderMode: RenderMode.Server
    },
    {
      path:'jet-game',
      renderMode: RenderMode.Server
    },
  // Fallback to prerender for everything else
  {
    path: '**',
    renderMode: RenderMode.Prerender
  }
];