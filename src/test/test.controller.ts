import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('meta')
@Controller('')
export class TestController {
  /**Test the server */
  @Get('test')
  @ApiOperation({ summary: 'Echo route for smoke checks; superseded by /health' })
  test() {
    return { message: 'Test route is working' };
  }
}
