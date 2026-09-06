import type { ProjectRepository } from "@/lib/projectRepository";
import { indexedDbProjectRepository } from "@/services/indexedDbProjectRepository";

// Composition root: future adapters replace this binding, not UI persistence code.
export const projectRepository: ProjectRepository = indexedDbProjectRepository;
