# Noti Documentation

This directory contains technical documentation for the Noti audio transcription platform.

## Documentation Structure

### Feature Documentation
- **[telegram-integration-2025-01-24.md](./telegram-integration-2025-01-24.md)** - Complete technical documentation for Telegram summary sharing integration

## Documentation Standards

### Naming Convention
Feature documentation files follow the pattern: `{feature-name}-{YYYY-MM-DD}.md`

- **feature-name**: Kebab-case description of the feature
- **YYYY-MM-DD**: Date when the feature was implemented/documented
- **Example**: `telegram-integration-2025-01-24.md`

### Content Structure
Each feature document should include:

1. **Overview** - High-level description and purpose
2. **Architecture** - System design and component relationships  
3. **Database Schema** - Table structures and relationships
4. **API Endpoints** - Request/response specifications
5. **Components** - UI component interfaces and behavior
6. **Integration Points** - How the feature connects to existing code
7. **Configuration** - Environment variables and setup
8. **Security Considerations** - Authentication, validation, and safety measures
9. **Error Handling** - Error categories and recovery strategies
10. **Testing** - Verification procedures and checklists
11. **Future Enhancements** - Planned improvements and extensions
12. **Troubleshooting** - Common issues and solutions
13. **Maintenance** - Ongoing care and monitoring

### Code Examples
- Use syntax highlighting with language specification
- Include complete, runnable examples where possible
- Provide both request and response samples for APIs
- Show error cases alongside success cases

### Diagrams
- Use ASCII art for simple architectural diagrams
- Keep diagrams focused and easy to understand
- Show data flow and component relationships

## Contributing

When adding new features:

1. Create feature documentation before or immediately after implementation
2. Use the established naming convention and structure
3. Include comprehensive technical details for future maintainers
4. Update this README to reference new documentation
5. Commit documentation with the feature implementation

## Questions?

For questions about existing features or documentation standards, refer to the feature-specific documentation or review the implementation in the source code.