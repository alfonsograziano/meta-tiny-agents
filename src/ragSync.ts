import { RAGIndexer } from "./rag/rag.ts";

const indexer = new RAGIndexer();
indexer.sync().catch(console.error);
