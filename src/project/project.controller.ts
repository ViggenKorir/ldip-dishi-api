import { Controller, Get, Param } from '@nestjs/common';
import { ProjectService } from './project.service';

@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Get()
  getProjects() {
    return this.projectService.getProjects();
  }

  @Get(':id')
  getProject(@Param('id') id: string) {
    return this.projectService.getProject(id);
  }
}
