export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const randomInt = (min, max) => {
  const minValue = Math.ceil(min);
  const maxValue = Math.floor(max);
  return Math.floor(Math.random() * (maxValue - minValue + 1)) + minValue;
};
