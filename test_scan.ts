import { scanMarkets, state } from './src/server/engine.ts';
state.settings.activeStrategy = 'v3';
scanMarkets().then(() => {
  console.log(state.coins.slice(0, 5).map(c => c.score));
  process.exit(0);
});
