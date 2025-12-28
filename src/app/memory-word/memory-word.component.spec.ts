import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MemoryWordComponent } from './memory-word.component';

describe('MemoryWordComponent', () => {
  let component: MemoryWordComponent;
  let fixture: ComponentFixture<MemoryWordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MemoryWordComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MemoryWordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
