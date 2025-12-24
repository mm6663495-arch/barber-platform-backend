-- تحديث الصالون ليكون نشط ومُعتمد
UPDATE Salon SET isActive = true, isApproved = true WHERE id = (SELECT salonId FROM Package WHERE id = 8);

-- التحقق من النتيجة
SELECT s.id, s.name, s.isActive, s.isApproved, p.id as packageId, p.name as packageName 
FROM Salon s 
JOIN Package p ON s.id = p.salonId 
WHERE p.id = 8;
