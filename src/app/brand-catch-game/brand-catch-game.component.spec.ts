import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrandCatchGameComponent } from './brand-catch-game.component';

describe('BrandCatchGameComponent', () => {
  let component: BrandCatchGameComponent;
  let fixture: ComponentFixture<BrandCatchGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrandCatchGameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BrandCatchGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
