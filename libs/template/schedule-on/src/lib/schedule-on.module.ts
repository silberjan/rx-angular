import { NgModule } from '@angular/core';

import { ScheduleOnDirective } from './schedule-on.directive';

@NgModule({
  declarations: [ScheduleOnDirective],
  exports: [ScheduleOnDirective],
})
export class ScheduleOnModule {}
