// Simple util polyfill for browser compatibility
export const inspect = (obj) => {
  return JSON.stringify(obj, null, 2);
};

export const debuglog = (section) => {
  return () => {};
};

export default {
  inspect,
  debuglog,
};
