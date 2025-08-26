import { RAG } from "./rag/rag.ts";

const rag = new RAG();
rag.sync().catch(console.error);
