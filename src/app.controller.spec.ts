import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService, APPLICATION_HOME_METADATA } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should render an informative HTML page', () => {
      const html = appController.getApplicationHomePage();

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain(APPLICATION_HOME_METADATA.message);
      expect(html).toContain(`href="${APPLICATION_HOME_METADATA.documentationUrl}`);
      expect(html).toContain(`href="${APPLICATION_HOME_METADATA.healthCheckUrl}`);
    });
  });
});
