declare module "imagetracerjs" {
  const ImageTracer: {
    imageToSVG(url: string, callback: (svg: string) => void, options?: Record<string, unknown>): void;
    imagedataToSVG(image: ImageData, options?: Record<string, unknown>): string;
  };
  export default ImageTracer;
}
