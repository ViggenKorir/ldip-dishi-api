import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  test() {
    return { message: 'Server is running...' };
  }
}
