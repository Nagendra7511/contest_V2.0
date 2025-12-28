import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DasboardtabsComponent } from './dasboardtabs.component';

describe('DasboardtabsComponent', () => {
  let component: DasboardtabsComponent;
  let fixture: ComponentFixture<DasboardtabsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DasboardtabsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DasboardtabsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
