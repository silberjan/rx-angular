import {
  ChangeDetectorRef,
  Directive,
  ElementRef,
  EmbeddedViewRef,
  ErrorHandler,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  TemplateRef,
  ViewContainerRef,
} from '@angular/core';
import {
  createTemplateManager,
  RxTemplateManager,
  RxBaseTemplateNames,
  RxViewContext,
} from '@rx-angular/cdk/template';
import {
  RxStrategyProvider,
  RxStrategyNames,
} from '@rx-angular/cdk/render-strategies';
import { coerceAllFactory } from '@rx-angular/cdk/coercing';
import { RxNotificationKind } from '@rx-angular/cdk/notifications';

import {
  defer,
  from,
  merge,
  NextObserver,
  Observable,
  ObservableInput,
  of,
  ReplaySubject,
  Subject,
  Subscription,
} from 'rxjs';

/** @internal */
type RxScheduleOnTemplateNames = 'nextTpl' | RxBaseTemplateNames;

/** @internal */
const RxScheduleOnTemplateNames = {
  ...RxBaseTemplateNames,
  next: 'nextTpl',
} as const;

/** @internal */
export interface RxScheduleOnViewContext<T> extends RxViewContext<T> {
  // to enable `as` syntax we have to assign the directives selector (var as v)
  scheduleOn: T;
}

/**
 * @Directive LetDirective
 *
 * @description
 *
 * The `*rxLet` directive serves a convenient way of binding observables to a view context. Furthermore, it helps
 * you structure view-related models into view context scope (DOM element's scope).
 *
 * Under the hood, it leverages a `RenderStrategy` which in turn takes care of optimizing the change detection
 * of your component or embedded view. The `LetDirective` will render its template and manage change detection after it
 *   got an initial value. So if the incoming `Observable` emits its value lazily (e.g. data coming from `Http`), your
 *   template will be rendered lazily as well. This can very positively impact the initial render performance of your
 *   application.
 *
 *
 * ### Problems with `async` and `*ngIf`
 *
 * In Angular, a way of binding an observable to the view could look like that:
 * ```html
 * <ng-container *ngIf="observableNumber$ | async as n">
 *   <app-number [number]="n"></app-number>
 *   <app-number-special [number]="n"></app-number-special>
 * </ng-container>
 * ```
 *
 * The problem is that `*ngIf` interferes with rendering and in case of a `0` (a falsy value) the component
 * would be hidden. This issue doesn't concern the `LetDirective`.
 *
 * The `AsyncPipe` relies on the Zone to be present - it doesn't really trigger change detection by itself.
 * It marks the component and its children as dirty waiting for the Zone to trigger change detection. So, in case
 * you want to create a zone-less application, the `AsyncPipe` won't work as desired. `LetDirective` comes
 * with its own strategies to manage change detection every time a new notification is sent from
 * the bound Observable.
 *
 *
 * ### Features of `*rxLet`
 *
 * Included features for `*rxLet`:
 * - binding is always present. (see "Problems with `async` and `*ngIf`" section below)
 * - it takes away the multiple usages of the `async` or `push` pipe
 * - a unified/structured way of handling null and undefined
 * - triggers change-detection differently if `zone.js` is present or not (`ChangeDetectorRef.detectChanges` or
 *   `ChangeDetectorRef.markForCheck`)
 * - triggers change-detection differently if ViewEngine or Ivy is present (`ChangeDetectorRef.detectChanges` or
 *   `ɵdetectChanges`)
 * - distinct same values in a row (`distinctUntilChanged` operator),
 * - display custom templates for different observable notifications (rxSuspense, rxNext, rxError, rxComplete)
 * - notify about after changes got rendered to the template (RenderCallback)
 *
 *
 * ### Binding an Observable and using the view context
 *
 * The `*rxLet` directive takes over several things and makes it more convenient and save to work with streams in the
 * template:
 *
 * ```html
 * <ng-container *rxLet="observableNumber$; let n">
 *   <app-number [number]="n"></app-number>
 * </ng-container>
 *
 * <ng-container *rxLet="observableNumber$ as n">
 *   <app-number [number]="n"></app-number>
 * </ng-container>
 * ```
 *
 * In addition to that it provides us information from the whole observable context.
 * We can track the observables:
 * - next value
 * - error occurrence
 * - complete occurrence
 *
 * ```html
 * <ng-container *rxLet="observableNumber$; let n; let e = $rxError, let c = $rxComplete">
 *   <app-number [number]="n" *ngIf="!e && !c"></app-number>
 *   <ng-container *ngIf="e">
 *     There is an error: {{ e }}
 *   </ng-container>
 *   <ng-container *ngIf="c">
 *     Observable completed: {{ c }}
 *   </ng-container>
 * </ng-container>
 * ```
 *
 *
 * ### Using the template-binding
 *
 * You can also use template anchors and display template's content for different observable states:
 * - on complete
 * - on error
 * - on suspense - before the first value is emitted
 *
 * ```html
 * <ng-container
 *   *rxLet="
 *     observableNumber$;
 *     let n;
 *     rxError: error;
 *     rxComplete: complete;
 *     rxSuspense: suspense;
 *   "
 * >
 *   <app-number [number]="n"></app-number>
 * </ng-container>
 * <ng-template #error>ERROR</ng-template>
 * <ng-template #complete>COMPLETE</ng-template>
 * <ng-template #suspense>SUSPENSE</ng-template>
 * ```
 *
 * Internally, `*rxLet` is using a simple "view memoization" - it caches all anchored template references and re-uses
 * them whenever the observable notification (next/error/complete) is sent. Then, it only updates the context
 * (e.g. a value from the observable) in the view.
 *
 *
 * @docsCategory LetDirective
 * @docsPage LetDirective
 * @publicApi
 */
@Directive({ selector: '[scheduleOn]' })
export class ScheduleOnDirective implements OnInit, OnDestroy, OnChanges {
  static ngTemplateGuard_scheduleOn: 'binding';

  /**
   * @description
   * The Observable to be bound to the context of a template.
   *
   * @example
   * const hero1 = {name: 'Batman'};
   * const hero$ = of(hero);
   *
   * <ng-container *scheduleOn="hero1; let hero">
   *   <app-hero [hero]="hero"></app-hero>
   * </ng-container>
   *
   * <ng-container *scheduleOn="hero$; let hero">
   *   <app-hero [hero]="hero"></app-hero>
   * </ng-container>
   *
   * @param potentialObservable
   */
  @Input()

  /**
   * @description
   * The rendering strategy to be used when rendering with the reactive context within a template.
   * Use it to dynamically manage your rendering strategy. You can switch the strategies
   * imperatively (with a string) or by bounding an Observable.
   * The default strategy is `'local'`.
   *
   * @example
   * \@Component({
   *   selector: 'app-root',
   *   template: `
   *     <ng-container *scheduleOn="hero$; let hero; strategy: strategy">
   *       <app-hero [hero]="hero"></app-hero>
   *     </ng-container>
   *   `
   * })
   * export class AppComponent {
   *   strategy = 'local';
   * }
   *
   * // OR
   *
   * \@Component({
   *   selector: 'app-root',
   *   template: `
   *     <ng-container *scheduleOn="hero$; let hero; strategy: strategy$">
   *       <app-hero [hero]="hero"></app-hero>
   *     </ng-container>
   *   `
   * })
   * export class AppComponent {
   *   strategy$ = new BehaviorSubject('local');
   * }
   *
   * @param strategy
   * @see {@link strategies}
   */
  @Input('scheduleOnStrategy')
  set strategy(strategyName: string | Observable<string> | undefined) {
    this.strategyHandler.next(strategyName);
  }

  @Input('scheduleOnRenderCallback')
  set renderCallback(callback: NextObserver<any>) {
    this._renderObserver = callback;
  }

  /* @todo: Rename to `rxRenderParent`? */
  // eslint-disable-next-line @angular-eslint/no-input-rename
  @Input('scheduleOnParent') renderParent = true;

  @Input('scheduleOnPatchZone') patchZone =
    this.strategyProvider.config.patchZone;

  constructor(
    private strategyProvider: RxStrategyProvider,
    public cdRef: ChangeDetectorRef,
    public eRef: ElementRef,
    private ngZone: NgZone,
    private readonly nextTemplateRef: TemplateRef<RxScheduleOnViewContext<any>>,
    private readonly viewContainerRef: ViewContainerRef,
    private errorHandler: ErrorHandler
  ) {}

  /** @internal */
  private strategyHandler = coerceAllFactory<string>(
    () => new ReplaySubject<RxStrategyNames<string>>(1)
  );

  /** @internal */
  private _renderObserver: NextObserver<any>;

  /** @internal */
  private subscription: Subscription = new Subscription();

  /** @internal */
  private templateManager: RxTemplateManager<
    any,
    RxScheduleOnViewContext<any | undefined | null>,
    RxScheduleOnTemplateNames
  >;

  /** @internal */
  private rendered$ = new Subject<void>();
  @Output() readonly rendered = defer(() => this.rendered$);

  /** @internal */
  ngOnInit() {
    this.subscription.add(
      this.templateManager
        // emit straight
        .render(
          of({
            value: true,
            hasValue: true,
            kind: RxNotificationKind.Next,
            error: false,
            complete: false,
          })
        )
        .subscribe((n) => {
          this.rendered$.next(n);
          this._renderObserver?.next(n);
        })
    );
  }

  /** @internal */
  ngOnChanges(changes: SimpleChanges) {
    if (!this.templateManager) {
      this._createTemplateManager();
    }
  }

  /** @internal */
  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  /** @internal */
  private _createTemplateManager(): void {
    this.templateManager = createTemplateManager<
      any,
      RxScheduleOnViewContext<any>,
      RxScheduleOnTemplateNames
    >({
      templateSettings: {
        viewContainerRef: this.viewContainerRef,
        createViewContext,
        updateViewContext,
        patchZone: this.patchZone ? this.ngZone : false,
      },
      renderSettings: {
        cdRef: this.cdRef,
        eRef: this.eRef,
        parent: !!this.renderParent,
        patchZone: this.patchZone ? this.ngZone : false,
        defaultStrategyName: this.strategyProvider.primaryStrategy,
        strategies: this.strategyProvider.strategies,
        errorHandler: this.errorHandler,
      },
      notificationToTemplateName: {
        [RxNotificationKind.Suspense]: () => RxScheduleOnTemplateNames.next,
        [RxNotificationKind.Next]: () => RxScheduleOnTemplateNames.next,
        [RxNotificationKind.Error]: () => RxScheduleOnTemplateNames.next,
        [RxNotificationKind.Complete]: () => RxScheduleOnTemplateNames.next,
      },
    });

    this.templateManager.addTemplateRef(
      RxScheduleOnTemplateNames.next,
      this.nextTemplateRef
    );
    this.templateManager.nextStrategy(this.strategyHandler.values$);
  }
}

/** @internal */
function createViewContext<T>(value: T): RxScheduleOnViewContext<T> {
  return {
    scheduleOn: value,
    $implicit: value,
    $error: false,
    $complete: false,
    $suspense: false,
  };
}

/** @internal */
function updateViewContext<T>(
  value: T,
  view: EmbeddedViewRef<RxScheduleOnViewContext<T>>,
  context: RxScheduleOnViewContext<T>
): void {
  Object.keys(context).forEach((k) => {
    view.context[k] = context[k];
  });
}
