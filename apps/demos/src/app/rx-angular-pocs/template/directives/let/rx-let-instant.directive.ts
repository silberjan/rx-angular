import { Directive, NgModule, OnDestroy, OnInit } from '@angular/core';
import { LetDirective } from '@rx-angular/template/let';
import { Subscription } from 'rxjs';
import { filter, switchMap, take } from 'rxjs/operators';

@Directive({
  selector: '[rxLet]',
})
export class RxLetInstant implements OnInit, OnDestroy {
  private sub = new Subscription();

  constructor(private letDir: LetDirective<any>) {}
  ngOnInit(): void {
    this.sub.add(
      (this.letDir as any).strategyHandler.values$
        .pipe(
          take(1),
          filter((strategy) => strategy === 'instant'),
          switchMap(() => this.letDir.values$.pipe(take(1)))
        )
        .subscribe(() => {
          this.letDir.strategy = 'normal';
        })
    );
  }
  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }
}

const DECLARATIONS = [RxLetInstant];

@NgModule({
  declarations: DECLARATIONS,
  imports: [],
  exports: DECLARATIONS,
})
export class RxLetInstantModule {}
