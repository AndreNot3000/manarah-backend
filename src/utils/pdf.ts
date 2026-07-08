import PDFDocument from "pdfkit";
import fs from "fs";

export function generateCertificatePdf(
  destPath: string,
  params: { name: string; competitionTitle: string; type: string; date: string }
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Create horizontal letter page landscape (792 x 612)
    const doc = new PDFDocument({
      size: "LETTER",
      layout: "landscape",
      margins: { top: 40, bottom: 40, left: 40, right: 40 }
    });

    const writeStream = fs.createWriteStream(destPath);
    doc.pipe(writeStream);

    // Green border outer frame
    doc.lineWidth(15)
       .strokeColor("#15803d") // green-700
       .rect(20, 20, 752, 572)
       .stroke();

    // Gold inner border frame
    doc.lineWidth(3)
       .strokeColor("#eab308") // gold-500
       .rect(32, 32, 728, 548)
       .stroke();

    // Title
    doc.fillColor("#1e293b")
       .font("Helvetica-Bold")
       .fontSize(36)
       .text("MANARAH", 40, 90, { align: "center" });

    doc.fillColor("#eab308")
       .fontSize(14)
       .font("Helvetica-Bold")
       .text("ONLINE LEARNING & COMPETITION PLATFORM", 40, 135, { align: "center" });

    // Subtitle
    doc.fillColor("#64748b")
       .font("Helvetica")
       .fontSize(18)
       .text("CERTIFICATE OF AWARD", 40, 185, { align: "center" });

    // Text
    doc.fillColor("#334155")
       .font("Helvetica-Oblique")
       .fontSize(14)
       .text("This certifies that", 40, 235, { align: "center" });

    // Student Name
    doc.fillColor("#15803d")
       .font("Helvetica-Bold")
       .fontSize(28)
       .text(params.name, 40, 275, { align: "center" });

    // Award Type
    doc.fillColor("#334155")
       .font("Helvetica")
       .fontSize(14)
       .text(`has successfully qualified for the status of`, 40, 325, { align: "center" });

    doc.fillColor("#1e293b")
       .font("Helvetica-Bold")
       .fontSize(18)
       .text(`${params.type} Award`, 40, 355, { align: "center" });

    doc.fillColor("#334155")
       .font("Helvetica")
       .fontSize(14)
       .text(`in the competition event`, 40, 395, { align: "center" });

    // Competition Title
    doc.fillColor("#1e293b")
       .font("Helvetica-Bold")
       .fontSize(20)
       .text(params.competitionTitle, 40, 425, { align: "center" });

    // Date
    doc.fillColor("#64748b")
       .font("Helvetica")
       .fontSize(11)
       .text(`Issued Date: ${params.date}`, 40, 490, { align: "center" });

    doc.end();

    writeStream.on("finish", () => resolve());
    writeStream.on("error", (err) => reject(err));
  });
}
