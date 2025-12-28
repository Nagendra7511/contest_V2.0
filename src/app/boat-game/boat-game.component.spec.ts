import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BoatGameComponent } from './boat-game.component';

describe('BoatGameComponent', () => {
  let component: BoatGameComponent;
  let fixture: ComponentFixture<BoatGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoatGameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BoatGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
