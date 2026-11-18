/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native Node modules (vector DB + ONNX embedding runtime) must not be bundled.
  serverExternalPackages: ['@lancedb/lancedb', '@huggingface/transformers', 'onnxruntime-node', 'sharp'],
  // The SQL Lab page reads the annotated query files from db/queries at runtime.
  outputFileTracingIncludes: { '/api/sql-lab': ['./db/queries/**'], '/sql-lab': ['./db/queries/**'] },
  devIndicators: false,
};

export default nextConfig;
