import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-error-page',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './error-page.html',
})
export class ErrorPage {}
