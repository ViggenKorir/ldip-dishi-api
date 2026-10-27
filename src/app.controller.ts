import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('meta')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: 'Root liveness ping; superseded by /health/live' })
  test() {
    return { message: 'Server is running...' };
  }
}
