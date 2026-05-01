import { Controller, Get, Header } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('status')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  getApplicationHomePage(): string {
    return this.appService.getApplicationHomePage();
  }
}
