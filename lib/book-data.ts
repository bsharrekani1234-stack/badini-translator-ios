import { BookPageData } from './book-types';
import { BOOK_PAGES_1_TO_45 } from './book-pages-1-to-45';
import { BOOK_PAGES_46_TO_95 } from './book-pages-46-to-95';
import { BOOK_PAGES_96_TO_142 } from './book-pages-96-to-142';

export const ALL_BOOK_PAGES: BookPageData[] = [
  ...BOOK_PAGES_1_TO_45,
  ...BOOK_PAGES_46_TO_95,
  ...BOOK_PAGES_96_TO_142,
];

export interface ChapterJumpItem {
  title: string;
  arabicTitle: string;
  page: number;
}

export const CHAPTER_INDEX: ChapterJumpItem[] = [
  { title: 'بەرگێ پەرتووکێ', arabicTitle: 'غلاف الكتاب', page: 1 },
  { title: 'مزگینی بۆ هەر نڤیسەر و بەلاڤکەرەکی', arabicTitle: 'بشرى لكل ناسخ وناشر', page: 5 },
  { title: 'هیڤی و داخواز', arabicTitle: 'رجاء', page: 6 },
  { title: 'پێشەکی و دوعایێن قورئانی', arabicTitle: 'مقدمة الكتاب', page: 7 },
  { title: 'ب ددانێن کورسیا خۆ ب حەقیێ ڤە بگرن', arabicTitle: 'عضوا على الحق بالنواجذ', page: 13 },
  { title: 'گەلی ئەهلێ سوننەت و جەماعەتێ!', arabicTitle: 'يا أهل السنة والجماعة!', page: 14 },
  { title: 'ئارمانج ژ پشت ڤێ پەرتووکێ', arabicTitle: 'الهدف من وراء هذا الكتاب', page: 19 },
  { title: 'دەرگەهێ ئێکێ: وێنەگرتن (التصوير)', arabicTitle: 'الباب الأول: التصوير', page: 20 },
  { title: 'زیانێن وێنە و پەیکەران', arabicTitle: 'أضرار الصور والتماثيل', page: 30 },
  { title: 'حوکمێ وێنەگرتنا رۆژێ و فۆتۆگرافی', arabicTitle: 'حكم التصوير الشمسي والفوتوغرافي', page: 34 },
  { title: 'وێنە و پەیکەرێن رێپێدای', arabicTitle: 'الصور والتماثيل المسموح بها', page: 39 },
  { title: 'فەتوایێن زانایێن مەزن د وێنەگرتنێ دا', arabicTitle: 'فتاوى كبار العلماء في التصوير', page: 46 },
  { title: 'هەلویست و لێدوان (ئیبن عوسەیمین و ئەلبەڕاک)', arabicTitle: 'موقف وتعليق', page: 68 },
  { title: 'دەرگەهێ دووێ: وێنەگرتنا شێخان ب ڤیدیۆیێ', arabicTitle: 'الباب الثاني: تصوير المشايخ بالفيديو', page: 86 },
  { title: 'ژ فەتوایێن لژنەیا هەردەمی', arabicTitle: 'من فتاوى اللجنة الدائمة', page: 97 },
  { title: 'پەرتووکا «ڤیدیۆیا ئیسلامی»', arabicTitle: 'كتاب «الفيديو الإسلامي»', page: 102 },
  { title: 'دوو گومان و بەرسڤا وان (گومانا ئێکێ)', arabicTitle: 'شبهتان والرد عليهما - الشبهة الأولى', page: 121 },
  { title: 'گومانا دووێ (پێلێن ئەلیکترۆنی)', arabicTitle: 'الشبهة الثانية', page: 126 },
  { title: 'بەلگەیا دوماهیێ', arabicTitle: 'الدليل الأخير', page: 128 },
  { title: 'دوماهیك (الخاتمة)', arabicTitle: 'الخاتمة', page: 132 },
  { title: 'هۆزانا قەحتانی', arabicTitle: 'قصيدة القحطاني', page: 135 },
  { title: 'دوعایا دوماهیێ و ناسنامەیا دانەری', arabicTitle: 'دعاء الختام', page: 138 },
  { title: 'پێرست (الفهرس)', arabicTitle: 'الفهرس', page: 141 },
];
