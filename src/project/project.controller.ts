import { Controller, Get, Param } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectService } from './project.service';

/** Starter scaffolding, not Dishi domain. Deprecated in the catalog. */
@ApiTags('deprecated')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  @ApiOperation({ summary: 'DEPRECATED scaffold: list demo projects' })
  getProjects() {
    return this.projectService.getProjects();
  }

  @Get(':id')
  @ApiOperation({ summary: 'DEPRECATED scaffold: demo project by id' })
  getProject(@Param('id') id: string) {
    return this.projectService.getProject(id);
  }
}
