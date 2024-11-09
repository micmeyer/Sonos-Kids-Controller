import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { AlertController } from "@ionic/angular";
import { MediaService } from "../service/media.service";
import { Media } from "../service/media";

@Component({
  selector: "app-edit",
  templateUrl: "./edit.page.html",
  styleUrls: ["./edit.page.scss"],
})
export class EditPage implements OnInit {
  media: Media[] = [];

  constructor(
    private mediaService: MediaService,
    public alertController: AlertController,
    private router: Router
  ) {}

  ngOnInit() {
    // Subscribe
    this.mediaService.getRawMediaObservable().subscribe((media) => {
      this.media = media;
    });

    // Retreive data through subscription above
    this.mediaService.updateRawMedia();
  }

  async deleteButtonPressed(index: number) {
    const alert = await this.alertController.create({
      cssClass: "alert",
      header: "Warning",
      message: "Do you want to delete the selected item from your library?",
      buttons: [
        {
          text: "Ok",
          handler: () => {
            this.mediaService.deleteRawMediaAtIndex(index);
          },
        },
        {
          text: "Cancel",
        },
      ],
    });

    await alert.present();
  }

  addButtonPressed() {
    this.router.navigate(["/add"]);
  }
}
