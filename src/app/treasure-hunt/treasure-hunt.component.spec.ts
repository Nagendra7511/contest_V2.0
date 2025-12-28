import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TreasureHuntComponent } from './treasure-hunt.component';

describe('TreasureHuntComponent', () => {
  let component: TreasureHuntComponent;
  let fixture: ComponentFixture<TreasureHuntComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TreasureHuntComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TreasureHuntComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
