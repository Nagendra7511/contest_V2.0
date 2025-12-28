import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ConfittiComponent } from './confitti.component';

describe('ConfittiComponent', () => {
  let component: ConfittiComponent;
  let fixture: ComponentFixture<ConfittiComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfittiComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ConfittiComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
