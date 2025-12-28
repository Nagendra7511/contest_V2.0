import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PriceMatchComponent } from './price-match.component';

describe('PriceMatchComponent', () => {
  let component: PriceMatchComponent;
  let fixture: ComponentFixture<PriceMatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PriceMatchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PriceMatchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
