import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlappyGameComponent } from './flappy-game.component';

describe('FlappyGameComponent', () => {
  let component: FlappyGameComponent;
  let fixture: ComponentFixture<FlappyGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlappyGameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FlappyGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
