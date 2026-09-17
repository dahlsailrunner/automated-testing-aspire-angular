import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-thank-you',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './thank-you.html',
})
export class ThankYou {}
