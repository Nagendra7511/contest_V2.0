import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaneGameComponent } from './plane-game.component';

describe('PlaneGameComponent', () => {
  let component: PlaneGameComponent;
  let fixture: ComponentFixture<PlaneGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaneGameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlaneGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
