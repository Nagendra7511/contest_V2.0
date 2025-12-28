import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DrapdropGameComponent } from './drapdrop-game.component';

describe('DrapdropGameComponent', () => {
  let component: DrapdropGameComponent;
  let fixture: ComponentFixture<DrapdropGameComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DrapdropGameComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DrapdropGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
