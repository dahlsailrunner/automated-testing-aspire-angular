import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatCardModule],
  templateUrl: './home.html',
  styleUrl: './home.scss',
})
export class Home {
  protected readonly stories = [
    {
      title: 'Splash Chic',
      subtitle: "Women's Wet Gear",
      img: 'https://www.pluralsight.com/content/dam/pluralsight2/teach/author-tools/carved-rock-fitness/story-1.jpg',
    },
    {
      title: 'Kid Klimbers',
      subtitle: "Children's Gear",
      img: 'https://www.pluralsight.com/content/dam/pluralsight2/teach/author-tools/carved-rock-fitness/story-2.jpg',
    },
    {
      title: 'Pack It In',
      subtitle: 'Camping Gear',
      img: 'https://www.pluralsight.com/content/dam/pluralsight2/teach/author-tools/carved-rock-fitness/story-4.jpg',
    },
    {
      title: "Nature's AC",
      subtitle: "Men's Shorts",
      img: 'https://www.pluralsight.com/content/dam/pluralsight2/teach/author-tools/carved-rock-fitness/story-3.jpg',
    },
  ];
}
