# Rasid Engineering Documentation Suite

This directory is the primary onboarding and maintenance guide for the active Rasid platform codebase in [rasid-platform-core](/C:/ALRaMaDy/rasid-platform-core).

## Recommended Reading Order

1. [system-overview.md](/C:/ALRaMaDy/docs/system-overview.md)
2. [architecture.md](/C:/ALRaMaDy/docs/architecture.md)
3. [modules.md](/C:/ALRaMaDy/docs/modules.md)
4. [database.md](/C:/ALRaMaDy/docs/database.md)
5. [apis.md](/C:/ALRaMaDy/docs/apis.md)
6. [dataflows.md](/C:/ALRaMaDy/docs/dataflows.md)
7. [infrastructure.md](/C:/ALRaMaDy/docs/infrastructure.md)
8. [deployment.md](/C:/ALRaMaDy/docs/deployment.md)
9. [testing.md](/C:/ALRaMaDy/docs/testing.md)
10. [security.md](/C:/ALRaMaDy/docs/security.md)
11. [performance.md](/C:/ALRaMaDy/docs/performance.md)
12. [c4-context.md](/C:/ALRaMaDy/docs/c4-context.md)
13. [c4-containers.md](/C:/ALRaMaDy/docs/c4-containers.md)
14. [c4-components.md](/C:/ALRaMaDy/docs/c4-components.md)
15. [c4-code.md](/C:/ALRaMaDy/docs/c4-code.md)

## Coverage Map

| Requested section | Primary document |
| --- | --- |
| System Overview | [system-overview.md](/C:/ALRaMaDy/docs/system-overview.md) |
| Architecture Overview | [architecture.md](/C:/ALRaMaDy/docs/architecture.md) |
| Module and Service Breakdown | [modules.md](/C:/ALRaMaDy/docs/modules.md) |
| Data Flow Architecture | [dataflows.md](/C:/ALRaMaDy/docs/dataflows.md) |
| Database Design | [database.md](/C:/ALRaMaDy/docs/database.md) |
| API Documentation | [apis.md](/C:/ALRaMaDy/docs/apis.md) |
| Internal Service Communication | [architecture.md](/C:/ALRaMaDy/docs/architecture.md) |
| Background Workers and Queues | [modules.md](/C:/ALRaMaDy/docs/modules.md), [infrastructure.md](/C:/ALRaMaDy/docs/infrastructure.md) |
| File Processing Pipelines | [dataflows.md](/C:/ALRaMaDy/docs/dataflows.md), [modules.md](/C:/ALRaMaDy/docs/modules.md) |
| OCR and Document Processing | [modules.md](/C:/ALRaMaDy/docs/modules.md), [dataflows.md](/C:/ALRaMaDy/docs/dataflows.md) |
| Layout Reconstruction Engine | [modules.md](/C:/ALRaMaDy/docs/modules.md) |
| Translation and Localization System | [modules.md](/C:/ALRaMaDy/docs/modules.md), [dataflows.md](/C:/ALRaMaDy/docs/dataflows.md) |
| Export and File Generation | [modules.md](/C:/ALRaMaDy/docs/modules.md), [deployment.md](/C:/ALRaMaDy/docs/deployment.md) |
| Security Model | [security.md](/C:/ALRaMaDy/docs/security.md) |
| Configuration and Environment Variables | [infrastructure.md](/C:/ALRaMaDy/docs/infrastructure.md), [deployment.md](/C:/ALRaMaDy/docs/deployment.md) |
| Infrastructure Architecture | [infrastructure.md](/C:/ALRaMaDy/docs/infrastructure.md) |
| Deployment Pipeline | [deployment.md](/C:/ALRaMaDy/docs/deployment.md) |
| Testing Strategy | [testing.md](/C:/ALRaMaDy/docs/testing.md) |
| Logging and Monitoring | [testing.md](/C:/ALRaMaDy/docs/testing.md) |
| Performance Considerations | [performance.md](/C:/ALRaMaDy/docs/performance.md), [testing.md](/C:/ALRaMaDy/docs/testing.md) |
| Scaling Strategy | [architecture.md](/C:/ALRaMaDy/docs/architecture.md), [testing.md](/C:/ALRaMaDy/docs/testing.md) |
| Failure Recovery | [testing.md](/C:/ALRaMaDy/docs/testing.md), [infrastructure.md](/C:/ALRaMaDy/docs/infrastructure.md) |
| Dependency Management | [architecture.md](/C:/ALRaMaDy/docs/architecture.md) |
| Future Extension Points | [architecture.md](/C:/ALRaMaDy/docs/architecture.md), [modules.md](/C:/ALRaMaDy/docs/modules.md) |

## Supplemental Reference Files

- [RASID_LITERAL_SERVICE_WIRING_GUIDE.md](/C:/ALRaMaDy/docs/RASID_LITERAL_SERVICE_WIRING_GUIDE.md): exact frontend-to-engine binding guidance for the current `apps/rasid-web` surfaces.
- [RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md](/C:/ALRaMaDy/docs/RASID_PROCEDURE_BY_PROCEDURE_BINDING_SPEC.md): procedure-level ownership matrix for `apps/rasid-web` tRPC namespaces.
- [docs/diagrams](/C:/ALRaMaDy/docs/diagrams): Mermaid sources for context, container, component, code, ERD, and data-flow diagrams.

## Documentation Boundaries

- The active deploy path is the contract-first monorepo centered on `apps/contracts-cli` and the shared engine packages.
- `apps/rasid-web` is documented because it is present, testable, and still owns a separate UI/server/runtime path.
- `rasid_core_seed/` is treated as seed/reference material, not the active platform implementation.
