import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InstaCommentsComponent } from './insta-comments.component';

describe('InstaCommentsComponent', () => {
  let component: InstaCommentsComponent;
  let fixture: ComponentFixture<InstaCommentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InstaCommentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(InstaCommentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
