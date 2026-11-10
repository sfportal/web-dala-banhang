# Sinh migrations/0002_seed.sql từ dữ liệu kế hoạch DaLa 2027 (giá dự kiến, có thể sửa trong trang quản trị)
import json, os
P = [
 dict(sku='BCX-350', slug='bot-chuoi-xanh-350g', name='Bột chuối xanh', subtitle='Kháng tinh bột · Hũ 350g', line='chuoi', kind='main',
  price=139000, wholesale_price=97000, cost=38000, stock=500, image='bcx-350', sort=1, weight_g=450, dims=(12,12,14), fragile=0,
  short_desc='Chuối xanh Tây Nguyên sấy nhiệt thấp, nghiền mịn để giữ tinh bột kháng. Pha sinh tố, nấu cháo, làm bánh, không đường thêm.',
  story='Ở vườn Đắk Lắk, chuối được thu khi còn xanh già, lúc tinh bột kháng cao nhất. Nhà máy sấy ở nhiệt độ thấp rồi nghiền mịn, không thêm đường, không phụ gia. Mỗi hũ có mã QR lô hàng: bạn thấy vườn trồng, ngày chế biến và phiếu kiểm nghiệm hàm lượng tinh bột kháng.',
  benefits=['Giàu tinh bột kháng và chất xơ, hỗ trợ tiêu hoá','No lâu, dễ thay một phần tinh bột trong bữa ăn','100% chuối xanh, không đường, không phụ gia','Công bố hàm lượng tinh bột kháng theo phiếu kiểm nghiệm từng lô'],
  usage='1–2 thìa (khoảng 15g) pha với 200ml nước ấm hoặc sữa, hoặc xay cùng sinh tố. Có thể thay một phần bột mì khi làm bánh, khuấy vào cháo, yến mạch. Đậy kín, bảo quản nơi khô mát.',
  ingredients='100% chuối xanh Tây Nguyên.', weight='350g', badges=['Chủ lực số 1','Kiểm nghiệm tinh bột kháng'], personas=['duong-huyet','van-phong'],
  seo_title='Bột chuối xanh kháng tinh bột 350g, không đường | DaLa', seo_desc='Bột chuối xanh Tây Nguyên sấy nhiệt thấp giữ tinh bột kháng, 100% chuối, không đường. Quét QR thấy vườn và phiếu kiểm nghiệm. Giao toàn quốc.'),
 dict(sku='BCX-S10', slug='bot-chuoi-xanh-10-goi', name='Bột chuối xanh dạng gói', subtitle='Dùng thử · Hộp 10 gói × 15g', line='chuoi', kind='trial',
  price=69000, wholesale_price=48000, cost=22000, stock=600, image='bcx-s10', sort=5, weight_g=220, dims=(16,8,12), fragile=0,
  short_desc='Mỗi gói 15g vừa một ly, mang đi làm, đi tập tiện lợi. Cỡ dùng thử cho lần đầu làm quen bột chuối xanh.',
  story='Gói nhỏ cho người bận rộn: xé gói, đổ vào bình lắc với nước hoặc sữa là xong bữa phụ. Cùng nguyên liệu và quy trình với hũ 350g.',
  benefits=['10 gói 15g, pha 1 phút','Tiện mang theo văn phòng, phòng tập','Cỡ dùng thử trước khi mua hũ lớn'],
  usage='Pha 1 gói với 150–200ml nước ấm, sữa hạt hoặc xay sinh tố.', ingredients='100% chuối xanh Tây Nguyên.', weight='10 × 15g',
  badges=['Dùng thử'], personas=['van-phong','duong-huyet'], seo_title='Bột chuối xanh gói 15g tiện lợi, hộp 10 gói | DaLa',
  seo_desc='Bột chuối xanh dạng gói 15g pha 1 phút, không đường. Cỡ dùng thử cho người bận rộn.'),
 dict(sku='CLTH-100', slug='chanh-leo-say-thang-hoa-100g', name='Chanh leo sấy thăng hoa', subtitle='100% nguyên chất · Túi zip 100g', line='chanhleo', kind='main',
  price=129000, wholesale_price=90000, cost=62000, stock=400, image='clth-100', sort=2, weight_g=180, dims=(22,16,6), fragile=1,
  short_desc='Lát chanh leo nguyên ruột sấy thăng hoa: giòn tan, chua thơm tự nhiên, không đường, không chiên dầu.',
  story='Tây Nguyên trồng 86,4% diện tích chanh leo cả nước. DaLa chọn trái tím chín cây, cắt lát rồi sấy thăng hoa ở nhiệt độ âm để giữ màu, mùi và vị chua thơm. Không đường, không chất bảo quản, chỉ có chanh leo.',
  benefits=['Giòn tan, ăn vặt nhẹ nhàng giữa giờ','Pha nước, rắc sữa chua, granola, trang trí bánh','Không đường thêm, không chiên dầu','Túi zip giữ giòn, mang theo tiện'],
  usage='Ăn trực tiếp; thả 3–4 lát vào nước ấm hoặc trà; rắc lên sữa chua, smoothie bowl. Đóng kín túi zip sau khi mở để giữ giòn.',
  ingredients='100% chanh leo tím Tây Nguyên.', weight='100g', badges=['Chủ lực','Biểu tượng Tây Nguyên'], personas=['me-be','van-phong','qua-tang'],
  seo_title='Chanh leo sấy thăng hoa 100% nguyên chất 100g | DaLa', seo_desc='Chanh leo Tây Nguyên sấy thăng hoa giòn tan, không đường, không chiên dầu. Quét QR thấy vườn trồng. Giao toàn quốc.'),
 dict(sku='CLTH-25', slug='chanh-leo-say-thang-hoa-25g', name='Chanh leo sấy thăng hoa', subtitle='Dùng thử · Gói 25g', line='chanhleo', kind='trial',
  price=39000, wholesale_price=27000, cost=18000, stock=800, image='clth-25', sort=6, weight_g=50, dims=(14,10,3), fragile=0,
  short_desc='Gói nhỏ 25g để thử vị giòn chua của chanh leo sấy thăng hoa, vừa một lần ăn.',
  story='Cỡ dùng thử cho người mua lần đầu, cho vào túi xách, hộp cơm hay làm quà nhỏ.',
  benefits=['Vừa một lần ăn','Giá dễ thử','100% chanh leo'], usage='Ăn trực tiếp hoặc pha nước.', ingredients='100% chanh leo tím Tây Nguyên.', weight='25g',
  badges=['Dùng thử'], personas=['van-phong','me-be'], seo_title='Chanh leo sấy thăng hoa gói 25g dùng thử | DaLa', seo_desc='Gói dùng thử chanh leo sấy thăng hoa 25g, giòn tan, không đường.'),
 dict(sku='COT-1L', slug='cot-chanh-leo-1l', name='Cốt chanh leo nguyên chất', subtitle='Chai 1L cho quán trà, cà phê', line='chanhleo', kind='b2b',
  price=139000, wholesale_price=115000, cost=59000, stock=300, image='cot-1l', sort=3, weight_g=1150, dims=(9,9,28), fragile=1,
  short_desc='Cốt chanh leo 100% nguyên chất, không đường, vị ổn định quanh năm cho quán trà, cà phê. Pha 1 cốt : 4 nước.',
  story='Quán trà cần một vị chanh leo đều tay mỗi ly. Cốt DaLa ép từ chanh leo tím Tây Nguyên, không pha đường để quán tự cân vị. Giao gần ở Tây Nguyên và Nam Trung Bộ, có giá sỉ theo thùng.',
  benefits=['100% chanh leo, không đường, quán tự cân vị','Vị ổn định từng lô, có QR truy xuất','Giá sỉ cho quán, xuất hoá đơn','Giao nhanh Tây Nguyên, Nam Trung Bộ'],
  usage='Tỷ lệ gợi ý 1 cốt : 4 nước. Lắc đều trước khi dùng. Sau khi mở, bảo quản lạnh và dùng theo hạn ghi trên nhãn.',
  ingredients='100% ruột chanh leo tím Tây Nguyên.', weight='1 lít', badges=['Chủ lực · B2B','Không đường'], personas=['quan-tra'],
  seo_title='Cốt chanh leo nguyên chất 1L không đường cho quán | DaLa', seo_desc='Cốt chanh leo 100% nguyên chất, không đường, vị ổn định cho quán trà, cà phê. Giá sỉ, giao nhanh Tây Nguyên.'),
 dict(sku='COT-250', slug='cot-chanh-leo-250ml', name='Cốt chanh leo nguyên chất', subtitle='Chai 250ml dùng tại nhà', line='chanhleo', kind='retail',
  price=45000, wholesale_price=32000, cost=18000, stock=500, image='cot-250', sort=7, weight_g=320, dims=(6,6,16), fragile=1,
  short_desc='Chai nhỏ 250ml không đường để pha nước chanh leo, trà chanh leo, làm sốt tại nhà.',
  story='Cùng cốt nguyên chất của quán, đóng chai nhỏ cho gia đình. Một chai pha được khoảng 5 ly.',
  benefits=['Pha khoảng 5 ly','Không đường, tự cân vị','Làm sốt, làm bánh, pha trà'], usage='Pha 1 cốt : 4 nước, thêm đá, mật ong tuỳ khẩu vị.',
  ingredients='100% ruột chanh leo tím Tây Nguyên.', weight='250ml', badges=['Không đường'], personas=['duong-huyet','van-phong'],
  seo_title='Cốt chanh leo 250ml nguyên chất không đường | DaLa', seo_desc='Cốt chanh leo nguyên chất 250ml, không đường, pha nước, trà, làm sốt tại nhà.'),
 dict(sku='KL-250', slug='khoai-lang-say-deo-250g', name='Khoai lang sấy dẻo', subtitle='Không đường · Túi 250g', line='khoailang', kind='addon',
  price=59000, wholesale_price=41000, cost=20000, stock=500, image='kl-250', sort=8, weight_g=290, dims=(20,14,5), fragile=0,
  short_desc='Khoai lang mật sấy dẻo tự nhiên, ngọt từ củ, không thêm đường. Chỉ bán kèm đơn hàng hoặc trong combo.',
  story='Khoai lang được hấp chín rồi sấy dẻo chậm, giữ vị ngọt tự nhiên của củ. Món ăn vặt quen thuộc, dẻo thơm, ăn kèm buổi xế.',
  benefits=['Ngọt tự nhiên, không đường thêm','Dẻo thơm, ăn no lâu','Mua kèm đơn hàng với giá tốt'], usage='Ăn trực tiếp, hâm nóng 10 giây cho mềm thơm.',
  ingredients='100% khoai lang.', weight='250g', badges=['Chỉ bán kèm'], personas=['van-phong','me-be'],
  seo_title='Khoai lang sấy dẻo không đường 250g | DaLa', seo_desc='Khoai lang sấy dẻo tự nhiên, không thêm đường, mua kèm đơn hàng DaLa.'),
 dict(sku='QUA-TET', slug='hop-qua-tet-nang-cao-nguyen', name='Hộp quà Nắng Cao Nguyên', subtitle='Quà Tết 2027 · 4 sản phẩm + trái tươi', line='qua', kind='gift',
  price=399000, wholesale_price=299000, cost=180000, stock=200, image='qua-tet', image_full=True, sort=4, weight_g=1800, dims=(35,25,10), fragile=1,
  short_desc='Hộp quà sơn mài xanh với chanh leo sấy, bột chuối xanh, khoai lang dẻo, cốt chanh leo và trái chanh leo tươi, kèm thư tay của nông dân.',
  story='Mỗi hộp là một câu chuyện vùng: từ vườn Đắk Lắk qua nhà máy đến tay người nhận. Có QR xem vườn trồng, có thư của người trồng, xuất hoá đơn cho doanh nghiệp và in logo theo yêu cầu khi đặt số lượng.',
  benefits=['Quà có câu chuyện vùng, không đụng hàng','Thư tay nông dân và QR xem vườn','Xuất hoá đơn, in thiệp doanh nghiệp','Giá sỉ từ 20 hộp'],
  usage='Bảo quản nơi khô mát; trái tươi dùng trong 7 ngày.', ingredients='Chanh leo sấy thăng hoa, bột chuối xanh, khoai lang sấy dẻo, cốt chanh leo, chanh leo tươi theo mùa.',
  weight='Hộp 35×25cm', badges=['Quà Tết 2027','Xuất hoá đơn'], personas=['qua-tang'],
  seo_title='Hộp quà Tết Nắng Cao Nguyên 2027, đặc sản Đắk Lắk | DaLa', seo_desc='Hộp quà Tết đặc sản Tây Nguyên: chanh leo sấy, bột chuối xanh, khoai lang dẻo, cốt chanh leo. Có QR, thư tay nông dân, xuất hoá đơn.'),
 dict(sku='CL-2KG', slug='chanh-leo-tim-tuoi-2kg', name='Chanh leo tím tươi', subtitle='Hộp 2kg có QR · Hái sáng, giao trong 48 giờ', line='tuoi', kind='seasonal',
  price=119000, wholesale_price=None, cost=95000, stock=150, image='cl-2kg', sort=9, weight_g=2200, dims=(30,20,12), fragile=1,
  short_desc='Chanh leo tím loại 1 hái sáng tại vườn, đóng hộp 2kg có QR, giao trong 48 giờ.',
  story='Trái chín cây, vỏ tím căng, ruột vàng thơm. Hộp có QR ghi tên vườn và ngày hái. Hàng theo mùa, số lượng có hạn.',
  benefits=['Hái sáng, giao trong 48 giờ','Loại 1, có QR vườn trồng','Hợp làm quà, pha nước tại nhà'], usage='Bảo quản nơi thoáng mát, trái hơi nhăn vỏ là ngọt nhất.',
  ingredients='Chanh leo tím tươi.', weight='2kg', badges=['Theo mùa'], personas=['qua-tang','me-be'],
  seo_title='Chanh leo tím tươi hộp 2kg hái tại vườn Đắk Lắk | DaLa', seo_desc='Chanh leo tím tươi loại 1 hái sáng, hộp 2kg có QR vườn trồng, giao trong 48 giờ.'),
 dict(sku='COMBO-KHOE', slug='combo-khoe-moi-ngay', name='Combo khỏe mỗi ngày', subtitle='Bột chuối + chanh leo sấy + khoai lang', line='combo', kind='combo',
  price=289000, compare_price=327000, wholesale_price=None, cost=120000, stock=0, image='combo-khoe', sort=10, weight_g=950, dims=(25,20,15), fragile=1,
  combo_items=[{'sku':'BCX-350','qty':1},{'sku':'CLTH-100','qty':1},{'sku':'KL-250','qty':1}],
  short_desc='Ba món cho một ngày nhẹ bụng: bột chuối xanh buổi sáng, chanh leo sấy giữa giờ, khoai lang dẻo buổi xế. Tiết kiệm 12% so với mua lẻ.',
  story='Combo được xếp theo nhịp một ngày làm việc: sáng pha bột chuối, trưa nhâm nhi chanh leo, chiều một túi khoai dẻo. Đủ dùng khoảng 3 tuần cho một người.',
  benefits=['Tiết kiệm 38.000đ so với mua lẻ','Đủ dùng khoảng 3 tuần','Hợp tặng người thân lo ăn uống lành mạnh'], usage='Xem hướng dẫn trên từng sản phẩm.',
  ingredients='Bột chuối xanh 350g, chanh leo sấy thăng hoa 100g, khoai lang sấy dẻo 250g.', weight='3 sản phẩm', badges=['Online −12%','Bán chạy'],
  personas=['van-phong','duong-huyet','qua-tang'], seo_title='Combo khỏe mỗi ngày: bột chuối, chanh leo sấy, khoai lang | DaLa',
  seo_desc='Combo 3 sản phẩm lành mạnh từ Tây Nguyên, tiết kiệm 12%. Không đường thêm, có QR truy xuất.'),
 dict(sku='COMBO-THU', slug='bo-dung-thu-3-vi', name='Bộ dùng thử 3 vị', subtitle='Bột chuối gói + chanh leo 25g + cốt 250ml', line='combo', kind='combo',
  price=129000, compare_price=153000, wholesale_price=None, cost=58000, stock=0, image='combo-dung-thu', sort=11, weight_g=600, dims=(18,14,12), fragile=1,
  combo_items=[{'sku':'BCX-S10','qty':1},{'sku':'CLTH-25','qty':1},{'sku':'COT-250','qty':1}],
  short_desc='Lần đầu biết DaLa? Thử đủ 3 dòng sản phẩm chủ lực với giá nhỏ, rồi chọn món hợp mình.',
  story='Bộ dùng thử gom cỡ nhỏ của cả ba dòng: bột chuối xanh, chanh leo sấy thăng hoa và cốt chanh leo. Cách rẻ nhất để biết vị DaLa.',
  benefits=['Thử cả 3 dòng chủ lực','Tiết kiệm 24.000đ','Hợp làm quà nhỏ'], usage='Xem hướng dẫn trên từng sản phẩm.',
  ingredients='Bột chuối xanh 10 gói × 15g, chanh leo sấy thăng hoa 25g, cốt chanh leo 250ml.', weight='3 sản phẩm', badges=['Mới','Cho người mua lần đầu'],
  personas=['van-phong','duong-huyet','me-be'], seo_title='Bộ dùng thử 3 vị DaLa: bột chuối, chanh leo sấy, cốt chanh leo',
  seo_desc='Thử cả 3 dòng sản phẩm DaLa với giá 129.000đ: bột chuối xanh, chanh leo sấy thăng hoa, cốt chanh leo.'),
 dict(sku='COMBO-NHA', slug='combo-an-vat-ca-nha', name='Combo ăn vặt cả nhà', subtitle='Chanh leo sấy 100g + 2 gói 25g + khoai lang', line='combo', kind='combo',
  price=229000, compare_price=266000, wholesale_price=None, cost=118000, stock=0, image='combo-ca-nha', sort=12, weight_g=600, dims=(25,18,12), fragile=1,
  combo_items=[{'sku':'CLTH-100','qty':1},{'sku':'CLTH-25','qty':2},{'sku':'KL-250','qty':1}],
  short_desc='Đồ ăn vặt từ trái cây thật cho cả nhà: không đường thêm, không chiên dầu, rõ vườn trồng.',
  story='Thay bánh kẹo bằng trái cây sấy: một túi chanh leo lớn để chia, hai gói nhỏ cho vào cặp, một túi khoai dẻo cho buổi chiều.',
  benefits=['Không đường thêm, không chiên dầu','Tiết kiệm 37.000đ','Gói nhỏ chia phần tiện'], usage='Xem hướng dẫn trên từng sản phẩm.',
  ingredients='Chanh leo sấy thăng hoa 100g, 2 gói chanh leo 25g, khoai lang sấy dẻo 250g.', weight='4 sản phẩm', badges=['Gia đình'],
  personas=['me-be','van-phong'], seo_title='Combo ăn vặt trái cây sấy cho cả nhà | DaLa', seo_desc='Combo ăn vặt trái cây sấy không đường cho gia đình: chanh leo sấy thăng hoa và khoai lang dẻo.'),
]
def q(v):
    if v is None: return 'NULL'
    if isinstance(v, bool): return '1' if v else '0'
    if isinstance(v, (int, float)): return str(v)
    if isinstance(v, (list, dict)): v = json.dumps(v, ensure_ascii=False)
    return "'" + str(v).replace("'", "''") + "'"
out = ['-- Dữ liệu khởi tạo theo kế hoạch bán lẻ DaLa 2027–2029 (giá có dấu * là ước lượng, sửa trong trang quản trị)']
for p in P:
    img = '/assets/img/' + p['image'] + '.webp'
    bg = '/assets/img/' + (p['image'] + '.webp' if p.get('image_full') else p['image'] + '-bg.webp' if os.path.exists(os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'img', p['image'] + '-bg.webp')) else p['image'] + '.webp')
    L, W, H = p['dims']
    cols = dict(sku=p['sku'], slug=p['slug'], name=p['name'], subtitle=p['subtitle'], line=p['line'], kind=p['kind'], price=p['price'],
        compare_price=p.get('compare_price'), wholesale_price=p.get('wholesale_price'), cost=p.get('cost'), stock=p['stock'], image=img, image_bg=bg,
        short_desc=p['short_desc'], story=p['story'], benefits=p['benefits'], usage=p['usage'], ingredients=p['ingredients'], weight=p['weight'],
        badges=p['badges'], personas=p['personas'], combo_items=p.get('combo_items'), seo_title=p['seo_title'], seo_desc=p['seo_desc'],
        weight_g=p['weight_g'], length_cm=L, width_cm=W, height_cm=H, fragile=p['fragile'], sort=p['sort'])
    out.append('INSERT INTO products (%s) VALUES (%s);' % (', '.join(cols), ', '.join(q(v) for v in cols.values())))
S = {
 'shop': {'name': 'DaLa', 'legal_name': 'HTX Nông nghiệp Công nghệ cao DaLa', 'slogan': 'Nắng cao nguyên, quét QR thấy vườn',
          'hotline': '', 'zalo': '', 'email': '', 'address': 'Buôn Ma Thuột, Đắk Lắk', 'facebook': '', 'tiktok_shop': '', 'shopee_shop': '', 'zalo_oa': ''},
 'shipping': {'free_threshold': 300000, 'fragile_fee': 10000, 'packaging_weight': 120, 'fragile_padding_cm': 2, 'goship_env': 'sandbox', 'pick': 'cheapest',
              'fallback_table': [[500, 25000], [1000, 30000], [2000, 38000]], 'fallback_step_500g': 5000,
              'origin': {'name': 'Kho DaLa', 'phone': '', 'street': '', 'city': '', 'district': '', 'ward': ''}},
 'payment': {'online_enabled': True, 'cod_enabled': True, 'cod_max': 3000000, 'thuchi_base': '', 'expire_minutes': 1440,
             'bank': {'bank': '', 'account': '', 'holder': ''}},
 'affiliate': {'tiers': [
     {'id': 1, 'name': 'Thành viên', 'min_sales': 0, 'direct': 15, 'l1': 2, 'l2': 1},
     {'id': 2, 'name': 'Đại sứ', 'min_sales': 5000000, 'direct': 20, 'l1': 2, 'l2': 1},
     {'id': 3, 'name': 'Trưởng nhóm', 'min_sales': 20000000, 'direct': 25, 'l1': 3, 'l2': 1}],
   'hold_days': 7, 'min_withdraw': 200000, 'payout_days': '5 và 20 hằng tháng', 'cookie_days': 30, 'buyer_discount_pct': 5,
   'lifetime_binding': True, 'auto_approve': True},
 'seo': {'title': 'DaLa · Trái cây Tây Nguyên chế biến lành mạnh, quét QR thấy vườn',
         'description': 'Bột chuối xanh kháng tinh bột, chanh leo sấy thăng hoa, cốt chanh leo nguyên chất từ vườn Đắk Lắk. 100% trái cây, không đường thêm, có QR truy xuất từng lô.',
         'keywords': 'bột chuối xanh, chanh leo sấy thăng hoa, cốt chanh leo, đặc sản Đắk Lắk, quà Tết Tây Nguyên',
         'og_image': '/assets/img/og.jpg', 'ga4': '', 'gsc_verify': '', 'fb_pixel': '', 'tiktok_pixel': '', 'head_extra': ''},
}
for k, v in S.items():
    out.append("INSERT INTO settings (key, value) VALUES (%s, %s);" % (q(k), q(v)))
out.append("""INSERT INTO flash_sales (name, starts_at, ends_at) VALUES ('Flash Sale mở bán', datetime('now','-1 hour'), datetime('now','+3 days'));""")
for sku, sp, quota, sold in [('CLTH-100', 109000, 100, 37), ('BCX-350', 119000, 80, 52), ('COMBO-THU', 99000, 50, 18), ('COMBO-KHOE', 259000, 40, 9)]:
    out.append(f"INSERT INTO flash_sale_items (sale_id, product_id, sale_price, quota, sold) SELECT 1, id, {sp}, {quota}, {sold} FROM products WHERE sku='{sku}';")
out += [
 "INSERT INTO vouchers (code, type, value, min_order, max_discount, first_order_only, note) VALUES ('CHAOBAN', 'pct', 10, 0, 30000, 1, 'Giảm 10% đơn đầu tiên, tối đa 30.000đ');",
 "INSERT INTO vouchers (code, type, value, min_order, note) VALUES ('FREESHIP199', 'freeship', 0, 199000, 'Miễn phí giao hàng đơn từ 199.000đ');",
]
for code, sku, farm, farmer, region, fc, hd, pd, ed, lab in [
 ('DL-CL-2611A', 'CLTH-100', 'Vườn chanh leo mẫu Ea Kar', 'Nông hộ liên kết (dữ liệu mẫu)', 'Ea Kar, Đắk Lắk', 'MSVT-DL-0001 (mẫu)', '2026-10-28', '2026-10-30', '2027-10-30', 'Đạt: dư lượng thuốc BVTV, kim loại nặng dưới ngưỡng (dữ liệu mẫu)'),
 ('DL-BC-2611B', 'BCX-350', 'Vườn chuối mẫu Krông Pắc', 'Nông hộ liên kết (dữ liệu mẫu)', 'Krông Pắc, Đắk Lắk', 'MSVT-DL-0002 (mẫu)', '2026-10-20', '2026-10-24', '2027-10-24', 'Tinh bột kháng: chờ phiếu kiểm nghiệm lô (dữ liệu mẫu)'),
 ('DL-COT-2611C', 'COT-1L', 'Vườn chanh leo mẫu Lắk', 'Nông hộ liên kết (dữ liệu mẫu)', 'Lắk, Đắk Lắk', 'MSVT-DL-0003 (mẫu)', '2026-11-02', '2026-11-03', '2027-05-03', 'Đạt chỉ tiêu vi sinh (dữ liệu mẫu)')]:
    out.append(f"INSERT INTO lots (code, product_id, farm, farmer, region, farm_code, harvest_date, process_date, expiry_date, lab_summary) SELECT {q(code)}, id, {q(farm)}, {q(farmer)}, {q(region)}, {q(fc)}, {q(hd)}, {q(pd)}, {q(ed)}, {q(lab)} FROM products WHERE sku={q(sku)};")
posts = [
 ('tinh-bot-khang-la-gi', 'Tinh bột kháng là gì và vì sao chuối xanh được nhắc nhiều?', 'Tinh bột kháng là loại tinh bột đi qua ruột non mà không bị tiêu hoá hết. Chuối xanh là một trong những nguồn tự nhiên phổ biến.',
  'Tinh bột kháng (resistant starch) là phần tinh bột không bị enzyme tiêu hoá hết ở ruột non, đi xuống ruột già và trở thành "thức ăn" cho vi khuẩn có lợi, giống như chất xơ.\n\nChuối càng xanh thì tinh bột kháng càng cao; khi chín, phần lớn chuyển thành đường. Vì vậy DaLa thu chuối khi còn xanh già và sấy ở nhiệt độ thấp, vì nhiệt độ cao làm giảm tinh bột kháng.\n\nCách dùng đơn giản: 1–2 thìa bột chuối xanh pha nước ấm hoặc xay cùng sinh tố vào bữa sáng. Bột chuối xanh là thực phẩm, không thay thế thuốc hay chỉ định của bác sĩ.', '/assets/img/bcx-350-bg.webp'),
 ('say-thang-hoa-khac-say-thuong', 'Sấy thăng hoa khác sấy thường thế nào?', 'Sấy thăng hoa làm đông trái cây rồi rút nước trong chân không, giữ màu, mùi và độ giòn mà không cần chiên dầu.',
  'Sấy thường dùng nhiệt để làm bay hơi nước, dễ làm trái cây sẫm màu và mất mùi. Sấy thăng hoa (freeze-drying) làm đông trái cây ở nhiệt độ âm sâu, sau đó hạ áp suất để nước đá thăng hoa thành hơi.\n\nKết quả là lát chanh leo giữ gần như nguyên hình dáng, màu vàng tím tự nhiên, giòn xốp và nhẹ, không cần đường hay dầu chiên.\n\nBảo quản: đóng kín túi zip sau khi mở vì sản phẩm hút ẩm rất nhanh.', '/assets/img/clth-100-bg.webp'),
 ('cong-thuc-tra-chanh-leo-cot-nguyen-chat', '3 công thức trà chanh leo với cốt nguyên chất', 'Tỷ lệ 1 cốt : 4 nước cho ly chanh leo đậm vị, cùng 3 biến tấu dễ làm tại nhà hay ở quán.',
  'Chanh leo đá: 40ml cốt DaLa, 160ml nước lạnh, 15ml mật ong hoặc syrup, đá viên.\n\nTrà xanh chanh leo: 30ml cốt, 150ml trà xanh ủ lạnh, 15ml syrup, vài lát chanh leo sấy thăng hoa trang trí.\n\nSoda chanh leo: 30ml cốt, 150ml soda, lá bạc hà. Vì cốt không đường nên bạn tự cân độ ngọt theo khẩu vị khách.', '/assets/img/cot-1l-bg.webp'),
]
for slug, title, ex, body, cover in posts:
    out.append(f"INSERT INTO posts (slug, title, excerpt, body, cover, seo_desc) VALUES ({q(slug)}, {q(title)}, {q(ex)}, {q(body)}, {q(cover)}, {q(ex)});")
open(os.path.join(os.path.dirname(__file__), '..', 'migrations', '0002_seed.sql'), 'w').write('\n'.join(out) + '\n')
print(len(out), 'statements')
