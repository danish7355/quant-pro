const state = {
  settings: {
    a: 1,
    b: 2
  }
};
const loadedState = {
  settings: {
    a: 10
  }
};
Object.assign(state, loadedState);
console.log(state.settings.b); // will be undefined!
