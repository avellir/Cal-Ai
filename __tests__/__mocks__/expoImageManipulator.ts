export const SaveFormat = {
  JPEG: 'jpeg',
  PNG: 'png',
};

export const manipulateAsync = jest.fn().mockResolvedValue({
  uri: 'file://compressed-image.jpg',
  width: 800,
  height: 600,
});
