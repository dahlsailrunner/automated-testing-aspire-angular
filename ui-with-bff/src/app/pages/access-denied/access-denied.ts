import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-access-denied',
  imports: [RouterLink, MatButtonModule],
  templateUrl: './access-denied.html',
})
export class AccessDenied {}
