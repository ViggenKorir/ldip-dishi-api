import { Controller, Get } from '@nestjs/common';

@Controller('')
export class TestController {
  /**Test the server */
  @Get('test')
  test() {
    return { message: 'Test route is working' };
  }
}
