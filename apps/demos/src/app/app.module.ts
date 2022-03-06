import { NgModule } from '@angular/core';

import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RxStrategyCredentials } from '@rx-angular/cdk/render-strategies';
import { AppComponent, AppComponentModule } from './app-component';
import { ENVIRONMENT_SETTINGS } from './shared/environment.token';
import { environment } from '../environments/environment';
import { HttpClientModule } from '@angular/common/http';
import { HomeComponent } from './features/home/home.component';
import { RX_RENDER_STRATEGIES_CONFIG } from '../../../../libs/cdk/render-strategies/src/lib/config';

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    AppComponentModule,
  ],
  providers: [
    {
      provide: ENVIRONMENT_SETTINGS,
      useValue: environment,
    },
    {
      provide: RX_RENDER_STRATEGIES_CONFIG,
      useValue: {
        primaryStrategy: 'normal',
        patchZone: true,
        customStrategies: {
          instant: {
            name: 'instant',
            work: (cdRef) => cdRef.detectChanges(),
            behavior: (work) => (o$) => {
              work();
              return o$;
            },
          },
        },
      },
    },
  ],
  declarations: [HomeComponent],
  exports: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
